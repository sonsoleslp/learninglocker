import { Map } from 'immutable';
import { TEMPLATE_TIME_SPENT } from 'lib/constants/visualise';
import { LAST_2_MONTHS } from 'ui/utils/constants';
import { description } from './constants';

/**
 * @param {immutable.Map} model
 * @returns {immutable.Map}
 */
const buildModel = model =>
  model
    .set('type', TEMPLATE_TIME_SPENT)
    .set('description', description)
    .set('axesgroup', new Map({ optionKey: 'people', searchString: 'Person' }))
    .set('axesoperator', 'timeSpent')
    .set('axesvalue', new Map({ optionKey: 'statements', searchString: 'Statements' }))
    .set('axesxLabel', 'Time spent (in minutes)')
    .set('axesyLabel', 'Person')
    .set('previewPeriod', LAST_2_MONTHS);

export default buildModel;
