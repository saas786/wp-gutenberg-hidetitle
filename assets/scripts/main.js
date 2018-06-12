const { select, subscribe, dispatch } = wp.data;
const { Button } = wp.components;
const { __ } = wp.i18n
const apiRequest = wp.apiRequest;
const { synchronizeBlocksWithTemplate, doBlocksMatchTemplate } = wp.blocks;

const SYNCHRONIZE_TEMPLATE_NOTICE_ID = 'SHARED_BLOCK_NOTICE_ID';

class GutenbergTemplates {
  constructor() {
    this.previousTemplate = null;
    this.template = null;

    subscribe(this.subscribe.bind(this));
  }

  subscribe() {
    const newTemplate = select('core/editor').getEditedPostAttribute('template');

    if (newTemplate !== this.template) {
      this.previousTemplate = this.template;
      this.template = newTemplate;

      if (newTemplate) {
        this.changeTemplate();
      } else if (this.previousTemplate !== null) {
        // If we're going back to default template.
        dispatch('core/editor').updateEditorSettings({templateLock: false});
      }
    }
  }

  changeTemplate() {
    const { resetBlocks, createWarningNotice, editPost, removeNotice, updateEditorSettings } = dispatch('core/editor');
    const currentBlocks = select('core/editor').getBlocks();

    apiRequest({ path: '/gutenberg-templates/v1/template', data: {template: this.template} }).then(config => {
      const template = config.template;
      const templateLock = config.template_lock;
      const isValidTemplate = !currentBlocks.length || doBlocksMatchTemplate(currentBlocks, template);

      const synchronizeTemplate = () => {
        resetBlocks(synchronizeBlocksWithTemplate(currentBlocks, template));
        updateEditorSettings({ templateLock });
      };

      const denySynchronization = () => {
        // If it's a locked template, revert the setting.
        if (templateLock === 'all') {
          editPost({ template: this.previousTemplate });
        }
        removeNotice(SYNCHRONIZE_TEMPLATE_NOTICE_ID);
      };

      const confirmSynchronization = () => {
        if (window.confirm(__('Resetting the template may result in loss of content, do you want to continue?'))) {
          synchronizeTemplate();
        }
        removeNotice(SYNCHRONIZE_TEMPLATE_NOTICE_ID);
      };

      if (isValidTemplate) {
        synchronizeTemplate();
      } else if (this.wasDefaultTemplate()) {
        createWarningNotice(
          <div className="editor-template-validation-notice">
            <p>{ __('The content of your post doesn\'t match the assigned template.') }</p>
            <div>
              <Button isDefault onClick={ denySynchronization }>{ __('Keep it as is') }</Button>
              <Button onClick={ confirmSynchronization } isPrimary>{ __('Reset the template') }</Button>
            </div>
          </div>
        , { isDismissible: false, id: SYNCHRONIZE_TEMPLATE_NOTICE_ID });
      }
    });
  }

  wasDefaultTemplate() {
    return this.previousTemplate === '';
  }
}

new GutenbergTemplates;