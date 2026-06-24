def excel_safe(value: str) -> str:
    """Guard against Excel/Sheets treating a leading +/-/=/@ as a formula trigger
    (e.g. phone numbers like "+91 98765 43210"). Wrapping in ="..." forces it to
    display as the literal text instead of being evaluated.
    """
    if value and value[0] in "+-=@":
        return f'="{value}"'
    return value
