import getAuthFromRequest from 'lib/helpers/getAuthFromRequest';
import catchErrors from 'api/controllers/utils/catchErrors';
import getScopeFilter from 'lib/services/auth/filters/getScopeFilter';
import Statement from 'lib/models/statement';
import mongoose from 'mongoose';
import { mapKeys } from 'lodash';

const objectId = mongoose.Types.ObjectId;

export const patchStatementMetadata = catchErrors(async (req, res) => {
  const authInfo = getAuthFromRequest(req);

  const scopeFilter = await getScopeFilter({
    modelName: 'statement',
    actionName: 'edit',
    authInfo
  });

  const filter = {
    $and: [
      { _id: objectId(req.params.id) },
      scopeFilter
    ]
  };

  const model = await Statement.findOneAndUpdate(filter, {
    $set: mapKeys(req.body, (_value, key) => `metadata.${key}`)
  }, { new: true, fields: ['_id'] });

  return res.status(200).send({ _id: model._id });
});

export const postStatementMetadata = catchErrors(async (req, res) => {
  const authInfo = getAuthFromRequest(req);

  const scopeFilter = await getScopeFilter({
    modelName: 'statement',
    actionName: 'edit',
    authInfo
  });

  const filter = {
    $and: [
      { _id: objectId(req.params.id) },
      scopeFilter
    ]
  };

  const model = await Statement.findOneAndUpdate(filter, {
    metadata: req.body
  }, { new: true, fields: '_id' });

  return res.status(200).send({ _id: model._id });
});

export default {
  patchStatementMetadata,
  postStatementMetadata
};