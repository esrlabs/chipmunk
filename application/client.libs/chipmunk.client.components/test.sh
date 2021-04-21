npm run build
rm -rf ../../client.core/node_modules/chipmunk-client-material
cp -R ./dist/chipmunk-client-material ../../client.core/node_modules/chipmunk-client-material
rake dev:update_client