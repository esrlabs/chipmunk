# Chipmunk Rules Index

## Overview

Repository code rules live under `.ai/rules/`.
They are binding for every code change and every review in this repository, and they apply on top of the context in `.ai/knowledge/`.
Use this file to choose the rule files that cover the areas being touched.
A section marked `Red Flag` is a violation a review must report, even when the rest of the change is sound.

## Rules

- All Rust code: `.ai/rules/rust.md`
- GUI application UI code: `.ai/rules/app-ui.md`
