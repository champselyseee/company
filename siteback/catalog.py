"""Каталог тарифов и типов работ переехал в core/catalog.py — он общий для бота и сайта.

Здесь только ре-экспорт, чтобы импорты `from . import catalog` в siteback продолжали работать.
"""

from core.catalog import *  # noqa: F401,F403
