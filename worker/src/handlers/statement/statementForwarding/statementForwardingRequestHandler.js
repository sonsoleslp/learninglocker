import { post } from 'axios';
import { assign, isPlainObject, get, set } from 'lodash';
import { PassThrough } from 'stream';
import highland from 'highland';
import getAttachments from '@learninglocker/xapi-statements/dist/service/utils/getAttachments';
import streamStatementsWithAttachments, { boundary }
  from '@learninglocker/xapi-statements/dist/expressPresenter/utils/getStatements/streamStatementsWithAttachments';
import logger from 'lib/logger';
import Statement, { mapDot } from 'lib/models/statement';
import mongoose from 'mongoose';
import StatementForwarding from 'lib/models/statementForwarding';
import ForwardingRequestError from
  'worker/handlers/statement/statementForwarding/ForwardingRequestError';
import {
  STATEMENT_FORWARDING_REQUEST_DELAYED_QUEUE,
} from 'lib/constants/statements';
import * as Queue from 'lib/services/queue';
import getStatementsRepo from './getStatementsRepo';
const crypto = require('crypto');

const objectId = mongoose.Types.ObjectId;
const generatePseudonym = (personalInformation) => {
  // Hash the personal information using the chosen hash function
  const hash = crypto.createHash(hashFunction);
  hash.update(personalInformation);
  let result =  hash.digest('hex');
  if ((typeof personalInformation == "string") && !!(personalInformation.match("mailto"))) {
    result = "mailto:" + result + "@anonymous.org";
  }

  return result;
  
}

const pseudonymizeXAPIStatement = (xAPIStatement) => {
  const fieldsToAnonymize = [
    'statement.actor.mbox', 
    'statement.actor.mbox_sha1sum', 
    'statement.actor.account.email', 
    'statement.actor.account.name', 
    'statement.actor.account.homePage', 
    'statement.actor.openid', 
    'statement.actor.name', 
    'statement.actor.member', 
    'agents', 
    'relatedAgents', 
    'registrations',
    'statement.context.registration'];
  fieldsToAnonymize.forEach(field => {
    try {
    const personalInformation = get(xAPIStatement, field);
    if (personalInformation) {
      if (personalInformation && Array.isArray(personalInformation)) {
        let pseudonym =  personalInformation.map(pi => {
          return generatePseudonym(pi);
        });
        set(xAPIStatement, field, pseudonym);
      } else {
        let pseudonym = generatePseudonym(personalInformation);
        set(xAPIStatement, field, pseudonym);
      }
      
    }
  } catch(ep){console.error(ep)}
  });
  return xAPIStatement;
}


// Choose a hash function
const hashFunction = 'sha256';

const generateHeaders = (statementForwarding, statement) => {
  const statementForwardingModel = new StatementForwarding(statementForwarding);
  const authHeaders = statementForwardingModel.getAuthHeaders();
  const nonAuthHeaders = statementForwardingModel.getHeaders(statement);
  const allHeaders = authHeaders.merge(nonAuthHeaders);
  return allHeaders.toJS();
};

const createBodyWithAttachments = async (statementModel, statementToSend) => {
  const repo = getStatementsRepo();
  const attachments = await getAttachments({ repo }, [statementModel], true, statementModel.lrs_id);
  const stream = highland();
  await streamStatementsWithAttachments(statementToSend, attachments, stream);
  const passthrough = new PassThrough();
  stream.pipe(passthrough);
  return passthrough;
};

const sendRequest = async (statementToSend, statementForwarding, fullStatement) => {
  const forwardingProtocol = statementForwarding.configuration.protocol;
  const forwardingUrl = statementForwarding.configuration.url;
  const url = `${forwardingProtocol}://${forwardingUrl}`;
  const statement = mapDot(statementToSend);
  const validateStatus = statusCode => statusCode >= 200 && statusCode < 400;
  const timeout = 5000;

  try {
    if (statementForwarding.sendAttachments) {
      const stream = await createBodyWithAttachments(fullStatement, statement);
      const headers = {
        ...generateHeaders(statementForwarding, fullStatement),
        'Content-Type': `multipart/mixed; charset=UTF-8; boundary=${boundary}`,
      };
      await post(url, stream, { headers, timeout, validateStatus });
    } else {
      const headers = {
        ...generateHeaders(statementForwarding, fullStatement),
        'Content-Type': 'application/json',
      };
      await post(url, statement, { headers, timeout, validateStatus });
    }
  } catch (err) {
    const message = err.response ? 'Status code was invalid' : err.message;
    const responseBody = err.response ? err.response.body : null;
    const responseStatus = err.response ? err.response.status : null;
    const headers = err.request ? err.request.headers : null;
    throw new ForwardingRequestError(message, { headers, responseBody, responseStatus, url });
  }
};

const setPendingStatements = (statement, statementForwardingId) =>
  Statement.updateOne({ _id: statement._id }, {
    $addToSet: {
      pendingForwardingQueue: statementForwardingId
    }
  });

const setCompleteStatements = (statement, statementForwardingId) =>
  Statement.updateOne({ _id: statement._id }, {
    $addToSet: {
      completedForwardingQueue: statementForwardingId
    },
    $pull: {
      pendingForwardingQueue: statementForwardingId
    }
  });

const statementForwardingRequestHandler = async (
  { statement, statementForwarding },
  done,
  {
    queue = Queue
  } = {}
) => {
  try {
    await setPendingStatements(
      statement,
      statementForwarding._id
    );
    console.log(JSON.stringify(statement, null, 4));
    console.log("///////////////////////////////");

    const statementPseudo = statementForwarding.pseudonymize ? pseudonymizeXAPIStatement(statement) : statement;
    console.log(JSON.stringify(statementPseudo, null, 4));

    await sendRequest(
      statementForwarding.fullDocument ? statementPseudo : statementPseudo.statement,
      statementForwarding,
      statementPseudo
    );

    await setCompleteStatements(statementPseudo, statementForwarding._id);

    logger.debug(
      `SUCCESS sending statement ${statement._id} to ${statementForwarding.configuration.url}`
    );

    done();
  } catch (err) {
    logger.info(
      `FAILED sending statement ${statement._id} to ${statementForwarding.configuration.url}`,
      err
    );

    let update = {
      timestamp: new Date(),
      statementForwarding_id: objectId(statementForwarding._id),
      message: err.toString()
    };

    if (err.messageBody) {
      if (isPlainObject(err.messageBody)) {
        update = assign({}, update, { errorInfo: err.messageBody });
      }
    }

    try {
      await Statement.updateOne(
        { _id: statement._id },
        {
          $addToSet: {
            failedForwardingLog: update
          }
        }
      );

      let updatedStatement = await Statement.findOne({ _id: statement._id });
      updatedStatement = statementForwarding.pseudonymize ? pseudonymizeXAPIStatement(updatedStatement) : updatedStatement;
      if (
        updatedStatement.failedForwardingLog.length <=
        statementForwarding.configuration.maxRetries
      ) {
        logger.info(`SENDING statement ${updatedStatement._id} to ${STATEMENT_FORWARDING_REQUEST_DELAYED_QUEUE}`);
        queue.publish({
          queueName: STATEMENT_FORWARDING_REQUEST_DELAYED_QUEUE,
          payload: {
            status: STATEMENT_FORWARDING_REQUEST_DELAYED_QUEUE,
            statement: updatedStatement,
            statementForwarding
          }
        }, (err) => {
          if (err) {
            logger.error(`FAILED sending statement ${updatedStatement._id} to ${STATEMENT_FORWARDING_REQUEST_DELAYED_QUEUE}`, err);
            done(err);
            throw new Error('Error publishing to queue');
          }
          done();
          return;
        });
      } else {
        logger.info(`EXCEEDED max retry for statement ${updatedStatement._id}, failing (should go to dead letter queue).`);
        done(err); // failed, let redrive send to dead letter queue
      }
    } catch (err) {
      logger.error('Failed updating failedForwardingLog', err);
    }
  }

  return [statement._id];
};

export default statementForwardingRequestHandler;
