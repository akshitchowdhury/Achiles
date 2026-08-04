"""Entry point — prints the resolved environment so the install can be sanity-checked."""

from __future__ import annotations

import langchain
import torch

from llm.config import settings


def environment_report() -> dict[str, str]:
    """Summarise the installed LLM toolchain."""
    return {
        "torch": torch.__version__,
        "langchain": langchain.__version__,
        "device": settings.resolved_device(),
        "cuda_available": str(torch.cuda.is_available()),
        "model": settings.model,
    }


def main() -> None:
    for key, value in environment_report().items():
        print(f"{key:>15}: {value}")


if __name__ == "__main__":
    main()
