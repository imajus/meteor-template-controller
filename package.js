Package.describe({
  summary: 'Syntactic sugar for blaze templates',
  name: 'imajus:template-controller',
  version: '0.0.1',
  git: 'https://github.com/imajus/meteor-template-controller'
});

Package.onUse(function(api) {
  api.versionsFrom(['2.0', '3.0']);
  api.use([
    'ecmascript',
    'reactive-var',
    'templating@1.3.4||1.4.4',
  ]);
  api.mainModule('index.js', 'client');
});
