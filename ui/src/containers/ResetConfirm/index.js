import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Portal from 'react-portal';
import { connect } from 'react-redux';
import { lowerCase } from 'lodash';
import { resetModel } from 'ui/redux/modules/models';

class ResetConfirm extends Component {
  static propTypes = {
    isOpened: PropTypes.bool,
    onClickClose: PropTypes.func,
    resetModel: PropTypes.func,
    schema: PropTypes.string,
    id: PropTypes.string,
    onReset: PropTypes.func,
    onResetModel: PropTypes.func,
    renderMessage: PropTypes.func
  }

  static defaultProps = {
    isOpened: false,
    onResetModel: () => null,
    renderMessage: ({ schema }) =>
      (<span>This will reset the {lowerCase(schema)} <b>permanently</b>. Are you sure?</span>)
  }

  onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.props.onReset) {
      this.props.onReset(this.props);
    } else {
      this.props.resetModel({
        schema: this.props.schema,
        id: this.props.id,
      });
      this.props.onClickClose();
    }
    this.props.onResetModel();
    this.props.onClickClose();
  }

  render = () => {
    const { isOpened, onClickClose } = this.props;

    return (
      <Portal isOpened={isOpened}>
        <span>
          <div className="modal animated fast fadeIn">
            <div className="modal-dialog">
              <div className="modal-content">

                <div className="modal-header modal-header-bg">
                  <button type="button" className="close" aria-label="Close" onClick={onClickClose.bind(null)}><span aria-hidden="true">&times;</span></button>
                  <h4 className="modal-title">Confirm reset</h4>
                </div>

                <div
                  className="modal-body clearfix"
                  style={{ maxHeight: '500px', overflow: 'auto', textAlign: 'center' }}>
                  {this.props.renderMessage(this.props)}
                </div>

                <div className="modal-footer" style={{ textAlign: 'center' }}>
                  <a
                    onClick={this.onClick.bind(null)}
                    className="btn btn-primary btn-sm">
                    <i className="icon ion-checkmark" /> Confirm
                  </a>
                  <a
                    onClick={onClickClose.bind(null)}
                    className="btn btn-primary btn-sm">
                    <i className="icon ion-close-round" /> Cancel
                  </a>
                </div>
              </div>
            </div>
            <div className="modal-backdrop" onClick={onClickClose.bind(null)} />
          </div>
        </span>
      </Portal>
    );
  }
}

export default connect(() => ({}), { resetModel })(ResetConfirm);
