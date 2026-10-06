"""缫丝盆门槛：标成已缫完须最近一次汤温落在 38～42℃；坞名门槛：空名禁止保存。"""

from app.models import Basin

MIN_TEMP = 38.0
MAX_TEMP = 42.0
MAX_NAME_LEN = 120


class RuleError(ValueError):
    pass


def clean_filature_name(raw: object) -> str:
    """回写坞名前的门槛：去空白，空名/超长一律拒收。"""
    name = str(raw or "").strip()
    if not name:
        raise RuleError("坞名不能为空")
    if len(name) > MAX_NAME_LEN:
        raise RuleError(f"坞名最长 {MAX_NAME_LEN} 字")
    return name


def latest_temp(basin: Basin) -> float | None:
    if not basin.readings:
        return None
    latest = max(basin.readings, key=lambda r: r.taken_at)
    return latest.water_temp_c


def assert_can_set_status(basin: Basin, new_status: str) -> None:
    allowed = {Basin.STATUS_SOAKING, Basin.STATUS_REELING, Basin.STATUS_REELED}
    if new_status not in allowed:
        raise RuleError(f"无效状态：{new_status}")
    if new_status != Basin.STATUS_REELED:
        return
    temp = latest_temp(basin)
    if temp is None:
        raise RuleError("该盆尚无汤温记录，不能标已缫完")
    if temp < MIN_TEMP or temp > MAX_TEMP:
        raise RuleError(
            f"最近汤温 {temp}℃ 不在 {MIN_TEMP:.0f}～{MAX_TEMP:.0f}℃，不能标已缫完"
        )
