import { Template } from 'meteor/templating';

class ReactiveObject {
  constructor(properties = {}) {
    this.addProperties(properties);
  }
  addProperty(key, defaultValue = null) {
    const property = new ReactiveVar(defaultValue);
    Object.defineProperty(this, key, {
      get: () => {
        return property.get();
      },
      set: (value) => {
        property.set(value);
      },
    });
  }
  addProperties(properties = {}) {
    for (let key of Object.keys(properties)) {
      this.addProperty(key, properties[key]);
    }
  }
}

// Helpers
const bindToTemplateInstance = function (handler) {
  return function () {
    return handler.apply(Template.instance(), arguments);
  };
};

const bindAllToTemplateInstance = function (handlers) {
  for (let key of Object.keys(handlers)) {
    handlers[key] = bindToTemplateInstance(handlers[key]);
  }
  return handlers;
};

// Errors
const templateNotFoundError = function (templateName) {
  let error = new Error(`No template <${templateName}> found.`);
  error.name = 'TemplateNotFoundError';
  return error;
};

const propertyValidatorRequired = function () {
  const error = new Error(
    '<data> must be a validator with #clean and #validate methods (see: SimpleSchema)'
  );
  error.name = 'PropertyValidatorRequired';
  return error;
};

const propertyValidationError = function (err, templateName) {
  const error = new Error(`in <${templateName}> ${err.message}`)
  error.name = 'PropertyValidationError';
  return error;
};

const rootElementRequired = function () {
  let error = new Error(
    'Please define a single root DOM element for your template.\n' +
      'Learn more about this issue: https://github.com/meteor-space/template-controller/issues/6'
  );
  error.name = 'RootElementRequired';
  return error;
};

const propsCleanConfiguration = {};

// We have to make it a global to support Meteor 1.2.x
export const TemplateController = function (
  templateName,
  {
    state,
    props,
    helpers,
    events,
    onCreated,
    onRendered,
    onDestroyed,
    ...config
  }
) {
  // Template reference
  const template = Template[templateName];
  if (!template) {
    throw templateNotFoundError(templateName);
  }
  // State & private instance methods
  template.onCreated(function () {
    this.props = new ReactiveObject();
    this.state = new ReactiveObject(state);
    // Private methods
    Object.assign(this, config.private);
    // Add sugar method for triggering custom jQuery events on the root node
    this.triggerEvent = function (eventName, data) {
      // Force best practice of having a single root element for components!
      if (this.firstNode !== this.lastNode) throw rootElementRequired();
      this.$(this.firstNode).trigger(eventName, data);
    };
    // Setup validated reactive props passed from the outside
    if (props) {
      this.autorun(() => {
        let data = Template.currentData() || {};
        if ('clean' in props && 'validate' in props) {
          // SimpleSchema API
          data = props.clean(data, {
            ...propsCleanConfiguration,
            mutate: false,
          });
          try {
            props.validate(data);
          } catch (err) {
            throw propertyValidationError(err, this.view.name);
          }
        } else if ('parse' in props) {
          // Zod API
          try {
            data = props.parse(data);
          } catch (err) {
            throw propertyValidationError(err, this.view.name);
          }
        } else {
          throw propertyValidatorRequired();
        }
        // Append/update properties
        for (const key of Object.keys(data)) {
          const value = data[key];
          if (!this.props.hasOwnProperty(key)) {
            this.props.addProperty(key, value);
          } else {
            this.props[key] = value;
          }
        }
      });
    }
  });
  // Helpers
  template.helpers(
    bindAllToTemplateInstance({
      ...helpers,
      state() {
        return this.state;
      },
      props() {
        return this.props;
      },
    })
  );
  // Events
  if (events) {
    template.events(bindAllToTemplateInstance(events));
  }
  // Lifecycle
  if (onCreated) template.onCreated(onCreated);
  if (onRendered) template.onRendered(onRendered);
  if (onDestroyed) template.onDestroyed(onDestroyed);
};

TemplateController.setPropsCleanConfiguration = (config) => {
  propsCleanConfiguration = config;
};

TemplateController.bindToTemplateInstance = bindToTemplateInstance;
TemplateController.bindAllToTemplateInstance = bindAllToTemplateInstance;
