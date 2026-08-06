// cloudfunctions/cycleCRUD/index.js
// 周期数据 CRUD 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, date, startDate, endDate } = event;

  switch (action) {

    // ---- 获取所有周期 ----
    case 'list': {
      const { data } = await db.collection('cycles')
        .where({ _openid: openid })
        .orderBy('startDate', 'desc')
        .limit(50)
        .get();
      return { data };
    }

    // ---- 标记某天为经期（智能合并相邻周期）----
    case 'markDay': {
      if (!date) return { error: 'date is required' };

      const existing = await db.collection('cycles')
        .where({ _openid: openid })
        .orderBy('startDate', 'desc')
        .get();

      const target = new Date(date);
      let cycle = null;

      // 检查是否在已有周期附近（前后 3 天内）
      for (const c of existing.data) {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        const beforeStart = new Date(start);
        beforeStart.setDate(beforeStart.getDate() - 4);
        const afterEnd = new Date(end);
        afterEnd.setDate(afterEnd.getDate() + 4);

        if (target >= beforeStart && target <= afterEnd) {
          cycle = c;
          break;
        }
      }

      if (cycle) {
        // 扩展已有周期
        const newStart = target < new Date(cycle.startDate)
          ? date
          : cycle.startDate;
        const newEnd = target > new Date(cycle.endDate)
          ? date
          : cycle.endDate;
        const periodLen = Math.round((new Date(newEnd) - new Date(newStart)) / 86400000) + 1;

        // 计算本周期长度
        let cycleLen = 28;
        const prevCycle = existing.data.find(
          c => new Date(c.startDate) < new Date(newStart)
        );
        if (prevCycle) {
          cycleLen = Math.round((new Date(newStart) - new Date(prevCycle.startDate)) / 86400000);
        }

        await db.collection('cycles').doc(cycle._id).update({
          data: {
            startDate: newStart,
            endDate: newEnd,
            periodLength: periodLen,
            cycleLength: cycleLen,
          },
        });
      } else {
        // 新建周期
        await db.collection('cycles').add({
          data: {
            _openid: openid,
            startDate: date,
            endDate: date,
            cycleLength: 28,
            periodLength: 1,
            createdAt: db.serverDate(),
          },
        });
      }
      return { success: true };
    }

    // ---- 删除周期 ----
    case 'delete': {
      if (!startDate) return { error: 'startDate is required' };
      await db.collection('cycles')
        .where({ _openid: openid, startDate })
        .remove();
      return { success: true };
    }

    // ---- 更新周期结束日期 ----
    case 'updateEndDate': {
      if (!startDate || !endDate) return { error: 'startDate and endDate are required' };

      const periodLen = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

      const existing = await db.collection('cycles')
        .where({ _openid: openid, startDate })
        .get();

      if (existing.data.length === 0) {
        return { error: 'cycle not found' };
      }

      await db.collection('cycles').doc(existing.data[0]._id).update({
        data: { endDate, periodLength: periodLen },
      });

      return { success: true };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
};
