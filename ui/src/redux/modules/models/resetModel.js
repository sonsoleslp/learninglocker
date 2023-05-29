import { createSelector } from 'reselect';
import { call, put } from 'redux-saga/effects';
import createAsyncDuck from 'ui/utils/createAsyncDuck';
import * as clearModelsCacheDuck from 'ui/redux/modules/pagination/clearModelsCache';
import { IN_PROGRESS, COMPLETED, FAILED } from 'ui/utils/constants';
import { modelsSelector } from 'ui/redux/modules/models/selectors';
import Unauthorised from 'lib/errors/Unauthorised';
import HttpError from 'ui/utils/errors/HttpError';

const resetStateSelector = schema => createSelector(
  [modelsSelector],
  models => models.getIn([schema, 'resetState'], false)
);

const shouldResetSelector = schema => createSelector(
  [resetStateSelector(schema)],
  resetState =>
    (resetState !== IN_PROGRESS && resetState !== COMPLETED && resetState !== FAILED)
);

const resetModel = createAsyncDuck({
  actionName: 'learninglocker/models/RESET_MODEL',

  successDelay: 2000,
  failureDelay: 2000,

  reduceStart: (state, { schema, id }) =>
    state.setIn([schema, id, 'resetState'], IN_PROGRESS),
  reduceSuccess: (state, { schema, id }) =>
    state.setIn([schema, id, 'resetState'], COMPLETED)
      .removeIn([schema, id, 'remoteCache']),
  reduceFailure: (state, { schema, id }) =>
    state.setIn([schema, id, 'resetState'], FAILED),
  reduceComplete: (state, { schema, id }) =>
    state.setIn([schema, id, 'resetState'], null),

  startAction: ({ schema, id }) => ({ schema, id }),
  successAction: ({ schema, id }) => ({ schema, id }),
  failureAction: ({ schema, id, message }) => ({ schema, id, message }),
  completeAction: ({ schema, id }) => ({ schema, id }),
  checkShouldFire: ({ schema }, state) => shouldResetSelector({ schema })(state),

  doAction: function* resetModelSaga({ schema, id, llClient }) {
    const { status, body } = yield call(llClient.resetStore, { storeId: id });

    if (status === 401) { throw new Unauthorised('Unauthorised'); }
    if (status >= 300) {
      const message = body.message || body;
      throw new HttpError(message, {
        status
      });
    }

    // check the status and throw errors if not valid
    yield put(clearModelsCacheDuck.actions.clearModelsCache({ schema }));

    // map the ids against the filter in the pagination store
    return yield { schema, id };
  }
});

export const selectors = { shouldResetSelector };
export const constants = resetModel.constants;
export const reducers = resetModel.reducers;
export const actions = resetModel.actions;
export const sagas = resetModel.sagas;
