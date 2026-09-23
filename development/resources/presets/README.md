# Preset fixtures

Shared test fixtures for preset documents, used by the preset import/export of the GUI and by the
preset loader of the CLI.

The documents mirror what the Chipmunk GUI exports, because the supported workflow is exporting a
preset from the GUI and passing the file to `chipmunk-cli --preset`.

Rules:

- Any change to the preset document format must add or update a fixture here, and both the GUI and
  the CLI tests must assert against it.
- `v2/basic.json` is compared against the current GUI exporter output, so a change in the exporter
  that is not reflected here fails the GUI tests.
- `legacy/` holds Chipmunk V3 TypeScript exports: the GUI imports them, the CLI rejects them.
- `cli/` holds presets written for the end-to-end runs of the CLI binary. They filter the sample
  logs next to this directory rather than pinning the document format:
  `cli/attachments_ecu2.json` selects the `ecu2` records of `../attachments.dlt`, and its filter
  value has to stay in sync with the expectation of the CLI test using it.
