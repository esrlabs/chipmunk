protoc \
    --plugin="protoc-gen-ts=./node_modules/.bin/protoc-gen-ts" \
    --ts_opt=esModuleInterop=true \
    --js_out="./src/generated" \
    --ts_out="./src/generated" \
    --proto_path="../../../../src/binding" \
    ../../../../src/binding/attachment.proto \
    ../../../../src/binding/common.proto \
    ../../../../src/binding/error.proto \
    ../../../../src/binding/event.proto \
    ../../../../src/binding/grabbing.proto \
    ../../../../src/binding/observe.proto \
    ../../../../src/binding/sde.proto

# protoc \
#     --plugin="protoc-gen-ts=./node_modules/.bin/protoc-gen-ts" \
#     --ts_opt=esModuleInterop=true \
#     --js_out="./dist/generated" \
#     --ts_out="./dist/generated" \
#     --proto_path="../../../../src/binding" \
#     ../../../../src/binding/attachment.proto \
#     ../../../../src/binding/common.proto \
#     ../../../../src/binding/error.proto \
#     ../../../../src/binding/event.proto \
#     ../../../../src/binding/grabbing.proto \
#     ../../../../src/binding/observe.proto \
#     ../../../../src/binding/sde.proto
