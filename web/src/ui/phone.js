import { formatSimTime } from '../sim/engine.js';

const ICON = { critical: '🚨', serious: '🧹', warning: '⚠️', good: '✅', info: '📊' };

/** LINE 官方帳號示意：警報卡片＋接單／完成按鈕＋圖文選單（回覆訊息不算推播額度） */
export function createPhone({ onAccept, onComplete, onQuery }) {
  const chat = document.getElementById('chat');
  const phone = document.getElementById('phone');
  const quota = document.getElementById('quota');
  let pushed = 0;
  const cards = new Map(); // orderId -> element

  function scroll() {
    chat.scrollTop = chat.scrollHeight;
  }

  function trim() {
    while (chat.children.length > 40) chat.removeChild(chat.firstChild);
  }

  function push(ev, sim, { reply = false } = {}) {
    const el = document.createElement('div');
    el.className = 'msg lv-' + (ev.level || 'info');
    const time = formatSimTime(sim ? sim.t : 0).split(' ')[1];
    el.innerHTML = `<div class="mt"><span aria-hidden="true">${ICON[ev.level] || '💬'}</span><span>${ev.title}</span></div>
      ${sim ? `<div class="site">${sim.name}</div>` : ''}
      <div>${ev.body}</div>
      <span class="time">${time}${reply ? '・回覆訊息（不計推播）' : ''}</span>`;
    if (ev.orderId && ev.level !== 'good') {
      const acts = document.createElement('div');
      acts.className = 'acts';
      const a = document.createElement('button');
      a.textContent = '我來處理';
      const c = document.createElement('button');
      c.textContent = '完成回報';
      c.disabled = true;
      a.addEventListener('click', () => onAccept(sim, ev.orderId));
      c.addEventListener('click', () => onComplete(sim, ev.orderId));
      acts.append(a, c);
      el.appendChild(acts);
      cards.set(ev.orderId, { a, c });
    }
    chat.appendChild(el);
    trim();
    scroll();
    if (!reply) {
      pushed++;
      quota.textContent = `本月主動推播 ${pushed} 則｜免費額度 200 則`;
      phone.classList.remove('buzz');
      void phone.offsetWidth;
      phone.classList.add('buzz');
    }
  }

  function mine(text) {
    const el = document.createElement('div');
    el.className = 'msg mine';
    el.textContent = text;
    chat.appendChild(el);
    trim();
    scroll();
  }

  function syncOrder(order) {
    const card = cards.get(order.id);
    if (!card) return;
    if (order.status === 'accepted') {
      card.a.disabled = true;
      card.a.textContent = `已接單・${order.who || ''}`;
      card.c.disabled = order.type === 'insert';
    } else if (order.status === 'done') {
      card.a.disabled = true;
      card.c.disabled = true;
      card.c.textContent = '已結案';
    }
  }

  document.querySelectorAll('#richmenu [data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      mine(b.textContent);
      onQuery(b.dataset.q);
    }),
  );

  return { push, mine, syncOrder };
}
