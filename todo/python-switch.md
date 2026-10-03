# What's left to finish the switch to Python

Branch: `feature/python-api`. The Python API is in `apps/api-py`.

## Already done
- [x] Python API written with FastAPI: `/`, `/health`, `POST /sessions`, `GET /sessions`
- [x] Server starts and answers correctly (checked by hand)
- [x] Bad data is rejected with a clear error
- [x] Ruff, ESLint and Prettier checks pass
- [x] CI updated to run the Python checks
- [x] README and CLAUDE.md updated
- [x] Committed and pushed to GitHub

## Still to do
1. [ ] **Start Docker.** Open Docker Desktop and wait for "Engine running".
2. [ ] **Create the database table.** Write the first Alembic migration, then apply it:
   ```bash
   cd apps/api-py
   source .venv/Scripts/activate
   alembic revision --autogenerate -m "create sessions table"
   alembic upgrade head
   ```
3. [ ] **Run the tests** (all 9 should pass): `pytest`
4. [ ] **Try it for real.** Start the server with `python -m app.main`, open
   http://localhost:4000/docs, and create a session.
5. [ ] **Decide about the old TypeScript API.** To delete it, run from the repo root:
   `git rm -r apps/api`, then `npm install`.
6. [ ] **Commit and push** the migration (and the deletion, if you did it).
7. [ ] **Open a Pull Request** on GitHub (`feature/python-api` into `main`) and check that CI is green.
8. [ ] **Merge it**, then `git checkout main` and `git pull`.

When all of this is ticked, the switch to Python is complete.
