import wrapHandlerForStatement from 'worker/handlers/statement/wrapHandlerForStatement';
import {
  STATEMENT_FORWARDING_QUEUE,
  STATEMENT_FORWARDING_REQUEST_QUEUE,
} from 'lib/constants/statements';
import StatementForwarding from 'lib/models/statementForwarding';
import { map, get, set } from 'lodash';

import mongoose from 'mongoose';
import * as Queue from 'lib/services/queue';
import logger from 'lib/logger';
import mongoFilteringInMemory from 'lib/helpers/mongoFilteringInMemory';
import parseQuery from 'lib/helpers/parseQuery';

const objectId = mongoose.Types.ObjectId;
const crypto = require('crypto');

const generatePseudonym = (personalInformation) => {
    // Hash the personal information using the chosen hash function
  if (personalInformation && Array.isArray(personalInformation)) {
    return personalInformation.map(pi => {
      const hash = crypto.createHash(hashFunction);
      hash.update(pi);
      return hash.digest('hex');
    });
  } else {
    const hash = crypto.createHash(hashFunction);
    hash.update(personalInformation);
    return hash.digest('hex');
  }
}

const pseudonymizeXAPIStatement = (xAPIStatement) => {
  const fieldsToAnonymize = [
    'statement.actor.mbox', 
    'statement.actor.mbox_sha1sum', 
    'statement.actor.account.email', 
    'statement.actor.account.name', 
    'statement.actor.account.homePage', 
    'statement.actor.openid', 
    'agents', 
    'relatedAgents', 
    'registrations',
    'statement.context.registration'];
  fieldsToAnonymize.forEach(field => {
    const personalInformation = get(xAPIStatement, field);
    console.log({field,personalInformation})
    if (personalInformation) {
      const pseudonym = generatePseudonym(personalInformation);
      set(xAPIStatement, field, pseudonym);
    }
  });
  return xAPIStatement;
}


// Choose a hash function
const hashFunction = 'sha256';


export default wrapHandlerForStatement(STATEMENT_FORWARDING_QUEUE, (statement, done, {
  queue = Queue
} = {}) =>
  StatementForwarding.find({
    organisation: objectId(statement.organisation),
    active: true,
    _id: {
      $nin: statement.completedForwardingQueue
    }
  }).then((statementForwardings) => {
    const promises = map(statementForwardings, async (statementForwarding) => {
      const queueName = STATEMENT_FORWARDING_REQUEST_QUEUE;

      const query = statementForwarding.query && JSON.parse(statementForwarding.query);
      const authInfo = {
        token: {
          tokenType: 'worker',
          tokenId: statement.organisation
        }
      };

      const parsedQuery = await parseQuery(query, { authInfo });

      return new Promise((resolve, reject) => {
        const theParsedQuery = parsedQuery && (parsedQuery.$match || parsedQuery);
        if (theParsedQuery && !mongoFilteringInMemory(theParsedQuery)(statement)) {
          return resolve();
        }
        console.log("pseudo//////////////////////////////",statementForwarding.pseudonymize)
        const statementSent = statementForwarding.pseudonymize ? pseudonymizeXAPIStatement(statement) : statement;
        console.log(JSON.stringify(statementSent, null, 4));
        console.log(JSON.stringify(statementForwarding.fullDocument, null, 4));
        queue.publish({
          queueName,
          payload: {
            status: queueName,
            statement: statementSent,
            statementForwarding
          }
        }, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    });

    return Promise.all(promises);
  }).then(() => {
    logger.debug('SUCCESS adding forwarding statement to forwarding statement request queue');
    return done();
  }).catch((err) => {
    logger.error('FAILED adding forwarding statement to forwarding statement request queue');
    return done(err);
  })
);
