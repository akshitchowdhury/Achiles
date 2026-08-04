# LLM

Python service layer for the achiles stack, alongside [server/](../server/) (Go) and [client/](../client/) (React + Vite).

Built on **LangChain** for orchestration and **PyTorch** for local model work.

## Layout

```
LLM/
├── src/llm/          package source
│   ├── config.py     env-backed settings, device resolution
│   └── main.py       entry point / environment report
├── tests/            pytest suite
├── pyproject.toml    project + tooling config
└── requirements.txt  runtime deps
```

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pytest ruff        # dev tooling
```

Then copy `.env.example` to `.env` and fill in the values.

### Windows long-path note

PyTorch ships a deeply nested license tree that exceeds the 260-character `MAX_PATH`
limit at this checkout depth. If `pip install torch` fails with
`[WinError 206] The filename or extension is too long`, either:

- enable long paths (needs admin): set
  `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` to `1`, or
- install through a short-path junction (no admin needed):

  ```powershell
  New-Item -ItemType Junction -Path C:\alm -Target <path-to-LLM>
  & C:\alm\.venv\Scripts\python.exe -m pip install -r C:\alm\requirements.txt
  cmd /c rmdir C:\alm
  ```

  The files land in the real venv; only the unused license files sit past `MAX_PATH`.

## Usage

```powershell
.\.venv\Scripts\python.exe -m pytest        # run tests
$env:PYTHONPATH="src"; .\.venv\Scripts\python.exe -m llm.main   # environment report
.\.venv\Scripts\python.exe -m ruff check .  # lint
```

## Installed versions

| Package | Version |
| --- | --- |
| Python | 3.13.14 |
| torch | 2.13.0+cpu |
| langchain | 1.3.14 |
| langchain-core | 1.5.3 |
| langchain-community | 0.4.2 |

`torch` is the CPU build (the PyPI default on Windows). For CUDA, reinstall from the
PyTorch index, e.g. `pip install torch --index-url https://download.pytorch.org/whl/cu124`.
