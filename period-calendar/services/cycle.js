/**
 * 周期数据服务层
 * 封装所有对云数据库 cycles 集合的 CRUD 操作
 */

/**
 * 获取用户所有历史周期记录
 */
async function listCycles() {
  const { result } = await wx.cloud.callFunction({
    name: 'cycleCRUD',
    data: { action: 'list' },
  });
  return (result && result.data) || [];
}

/**
 * 标记某一天为经期
 * 云函数会自动判断是新建周期还是扩展现有周期
 */
async function markDay(date) {
  const { result } = await wx.cloud.callFunction({
    name: 'cycleCRUD',
    data: { action: 'markDay', date },
  });
  return result;
}

/**
 * 删除一条周期记录（按开始日期）
 */
async function deleteCycle(startDate) {
  const { result } = await wx.cloud.callFunction({
    name: 'cycleCRUD',
    data: { action: 'delete', startDate },
  });
  return result;
}

/**
 * 更新周期结束日期
 */
async function updateEndDate(startDate, endDate) {
  const { result } = await wx.cloud.callFunction({
    name: 'cycleCRUD',
    data: { action: 'updateEndDate', startDate, endDate },
  });
  return result;
}

module.exports = {
  listCycles,
  markDay,
  deleteCycle,
  updateEndDate,
};
