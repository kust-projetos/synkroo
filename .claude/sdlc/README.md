# .claude/sdlc

- `fix-mode`: arquivo vazio. Existe → hook `test-lock` bloqueia edição em `tests/`, `*.test.*`, `*.spec.*`. Criar ao começar fix de bug, apagar ao terminar.
- `protected-paths`: um glob por linha (`#` comenta). Hook `protected-paths` bloqueia Edit/Write que casa.
