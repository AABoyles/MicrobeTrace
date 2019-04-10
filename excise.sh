rm -rf .git demo/ docs/ node_modules/ test/ \
  *.md *.sh package-lock.json\
  cache.extra Dockerfile postcss.config.js \
  stylesheets/bundle.css scripts/bundle.js
echo "" > stylesheets/bundle.css
echo "" > scripts/bundle.js
