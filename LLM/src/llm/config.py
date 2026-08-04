"""Runtime configuration for the LLM package."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Environment-backed settings."""

    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    model: str = os.getenv("LLM_MODEL", "claude-sonnet-5")
    device: str = os.getenv("TORCH_DEVICE", "")

    def resolved_device(self) -> str:
        """Return the configured torch device, or the best available one."""
        if self.device:
            return self.device

        import torch

        if torch.cuda.is_available():
            return "cuda"
        return "cpu"


settings = Settings()
