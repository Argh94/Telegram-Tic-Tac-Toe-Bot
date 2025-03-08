// ذخیره دیتای هر کاربر
const userData = new Map();

// توکن بات تلگرام
const BOT_TOKEN = 'Telegram Token bot';

// ثبت آمار بازی‌ها
const stats = {
  totalGames: 0,
  userWins: 0,
  botWins: 0,
  draws: 0,
};

// حالت‌های بازی (استفاده از Enum)
const GAME_MODES = {
  SINGLE_PLAYER: 'single_player',
};

// فراخوانی تابع handleRequest برای پاسخ‌گویی به درخواست‌ها
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// مدیریت درخواست‌ها
async function handleRequest(request) {
  try {
    console.log('Received request:', request.method, request.url); // لاگ برای ردیابی درخواست
    clearInactiveUsers(); // پاک کردن کاربران غیرفعال

    if (request.method === 'POST') {
      const update = await request.json();
      console.log('Received update:', JSON.stringify(update)); // لاگ برای ردیابی آپدیت

      const message = update.message || update.callback_query?.message;
      const chatId = message?.chat?.id;
      const text = message?.text || '';
      const data = update.callback_query?.data || '';
      const messageId = message?.message_id;

      console.log(`Processing update for chatId: ${chatId}, data: ${data}`); // لاگ برای ردیابی

      if (!chatId || !messageId) {
        console.error('chatId or messageId is undefined');
        return new Response('Bad Request', { status: 400 });
      }

      if (text === '/start' || data === 'new_game') {
        const startKeyboard = {
          inline_keyboard: [
            [{ text: 'شروع بازی تک نفره 🤖', callback_data: 'mode_single' }],
            [{ text: 'نمایش آمار 📊', callback_data: 'show_stats' }],
            [{ text: 'راهنمای بازی 📖', callback_data: 'show_help' }],
          ],
        };

        if (data === 'new_game') {
          await editMessage(chatId, messageId, '🎮 به بازی دوز خوش آمدید!\nحالت بازی را انتخاب کنید:', startKeyboard);
        } else {
          await sendMessage(chatId, '🎮 به بازی دوز خوش آمدید!\nحالت بازی را انتخاب کنید:', startKeyboard);
        }
      } else if (data === 'mode_single') {
        const mode = GAME_MODES.SINGLE_PLAYER;
        const sizeKeyboard = {
          inline_keyboard: [
            [{ text: '3×3', callback_data: `size_3_${mode}` }],
            [{ text: '4×4', callback_data: `size_4_${mode}` }],
            [{ text: 'سفارشی ✏️', callback_data: `size_custom_${mode}` }],
            [{ text: 'بازگشت 🔙', callback_data: 'back_to_start' }],
          ],
        };
        await editMessage(chatId, messageId, '🔢 اندازه صفحه بازی را انتخاب کنید:', sizeKeyboard);
      } else if (data.startsWith('size_')) {
        const [_, size, mode] = data.split('_');
        if (size === 'custom') {
          await editMessage(chatId, messageId, '✏️ لطفاً اندازه صفحه بازی را وارد کنید (مثلاً 5):');
          userData.set(chatId, { waitingForCustomSize: true, mode, lastMessageId: messageId });
        } else {
          await startGame(chatId, parseInt(size), mode, messageId);
        }
      } else if (userData.get(chatId)?.waitingForCustomSize) {
        const size = parseInt(text);
        if (size >= 3 && size <= 8) {
          await startGame(chatId, size, userData.get(chatId).mode, userData.get(chatId).lastMessageId);
        } else {
          await editMessage(chatId, userData.get(chatId).lastMessageId, '❌ اندازه صفحه باید بین ۳ تا ۸ باشد. لطفاً یک عدد معتبر وارد کنید:');
        }
      } else if (data.startsWith('move_')) {
        const [_, index] = data.split('_');
        await handleMove(chatId, parseInt(index));
      } else if (data === 'back_to_start') {
        const startKeyboard = {
          inline_keyboard: [
            [{ text: 'شروع بازی تک نفره 🤖', callback_data: 'mode_single' }],
            [{ text: 'نمایش آمار 📊', callback_data: 'show_stats' }],
            [{ text: 'راهنمای بازی 📖', callback_data: 'show_help' }],
          ],
        };
        await editMessage(chatId, messageId, '🔙 به منوی اصلی بازگشتید! حالت بازی را انتخاب کنید:', startKeyboard);
      } else if (data === 'show_stats') {
        const statsMessage = `📊 آمار بازی‌ها:
  - تعداد کل بازی‌ها: ${stats.totalGames}
  - بردهای شما: ${stats.userWins} 🏆
  - بردهای ربات: ${stats.botWins} 🤖
  - تساوی‌ها: ${stats.draws} 🤝`;
        const statsKeyboard = {
          inline_keyboard: [[{ text: 'بازگشت 🔙', callback_data: 'back_to_start' }]],
        };
        await editMessage(chatId, messageId, statsMessage, statsKeyboard);
      } else if (data === 'show_help') {
        const helpMessage = `📖 راهنمای بازی دوز:
    1. برای شروع بازی از /start استفاده کنید.
    2. اندازه صفحه بازی را انتخاب کنید (۳×۳ تا ۸×۸).
    3. شما ❌ هستید و ربات ⭕.
    4. برای لغزش‌زنی از دکمه ⏪ استفاده کنید.
    5. برای بازگشت به منوی اصلی از دکمه 🔙 استفاده کنید.`;
        const helpKeyboard = {
          inline_keyboard: [
            [{ text: 'شروع بازی 🎮', callback_data: 'new_game' }],
            [{ text: 'بازگشت به منوی اصلی 🔙', callback_data: 'back_to_start' }],
          ],
        };
        await editMessage(chatId, messageId, helpMessage, helpKeyboard);
      } else if (data === 'undo') {
        await undoMove(chatId);
      }
    }
    return new Response('OK');
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// پاکسازی کاربران غیرفعال
function clearInactiveUsers() {
  const now = Date.now();
  userData.forEach((user, chatId) => {
    if (now - user.lastActivity > 60000) { // 60 ثانیه
      userData.delete(chatId);
      console.log(`Cleared inactive user: ${chatId}`); // لاگ برای ردیابی
    }
  });
}

// شروع بازی جدید
async function startGame(chatId, size, mode, lastMessageId) {
  const gameKeyboard = createGameBoard(size);
  const gameBoardText = formatGameBoard(gameKeyboard.inline_keyboard);
  try {
    await editMessage(
      chatId,
      lastMessageId,
      `🎮 بازی ${size}×${size} شروع شد!\nشما ❌ هستید و ربات ⭕. نوبت شماست:\n\n${gameBoardText}`,
      gameKeyboard
    );
    userData.set(chatId, {
      board: gameKeyboard,
      lastActivity: Date.now(),
      messageId: lastMessageId,
      size,
      mode,
      history: [],
      currentPlayer: 'X', // کاربر اول همیشه X است
    });
  } catch (error) {
    console.error('Error starting game:', error);
  }
}

// پردازش حرکت کاربر
async function handleMove(chatId, index) {
  console.log(`Handling move for chatId: ${chatId}, index: ${index}`); // لاگ برای ردیابی
  try {
    const user = userData.get(chatId);
    if (!user) return;

    const board = JSON.parse(JSON.stringify(user.board.inline_keyboard));
    const row = Math.floor(index / user.size);
    const col = index % user.size;

    if (board[row][col].text !== ' ') return;

    board[row][col].text = 'X';
    user.history.push({ row, col, player: 'X' });

    const winner = checkWinner(board, user.size, { row, col });
    if (winner) {
      await endGame(chatId, winner);
      return;
    }
    if (isBoardFull(board)) {
      await endGame(chatId, null);
      return;
    }

    user.currentPlayer = 'O';
    const botMove = getBotMove(board, user.size);
    if (botMove) {
      board[botMove.row][botMove.col].text = 'O';
      user.history.push({ row: botMove.row, col: botMove.col, player: 'O' });

      const winnerAfterBotMove = checkWinner(board, user.size, botMove);
      if (winnerAfterBotMove) {
        await endGame(chatId, winnerAfterBotMove);
        return;
      }
      if (isBoardFull(board)) {
        await endGame(chatId, null);
        return;
      }

      user.currentPlayer = 'X';
    }

    user.board.inline_keyboard = board;
    user.lastActivity = Date.now();
    await updateGame(chatId, user);
  } catch (error) {
    console.error('Error in handleMove:', error);
  }
}

// پایان بازی
async function endGame(chatId, winner) {
  stats.totalGames++;
  let message;
  if (winner === 'X') {
    message = '🎉 تبریک! شما برنده شدید! 🏆';
    stats.userWins++;
  } else if (winner === 'O') {
    message = '🤖 ربات برنده شد! 🏆';
    stats.botWins++;
  } else {
    message = '🤝 بازی مساوی شد!';
    stats.draws++;
  }
  const newGameKeyboard = {
    inline_keyboard: [
      [{ text: 'بازی جدید 🎮', callback_data: 'new_game' }],
      [{ text: 'نمایش آمار 📊', callback_data: 'show_stats' }],
    ],
  };
  await editMessage(chatId, userData.get(chatId).messageId, message, newGameKeyboard);
  userData.delete(chatId);
}

// به‌روزرسانی صفحه بازی
async function updateGame(chatId, user) {
  const gameBoardText = formatGameBoard(user.board.inline_keyboard);
  const keyboard = {
    inline_keyboard: [...user.board.inline_keyboard, [{ text: 'لغزش‌زنی ⏪', callback_data: 'undo' }]],
  };
  try {
    await editMessage(chatId, user.messageId, `🔄 نوبت ${user.currentPlayer === 'X' ? 'شما (❌)' : 'ربات (⭕)'}:\n\n${gameBoardText}`, keyboard);
  } catch (error) {
    console.error('Error updating game:', error);
  }
}

// ایجاد صفحه بازی
function createGameBoard(size) {
  const rows = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      text: ' ',
      callback_data: `move_${i * size + j}`,
    }))
  );
  return { inline_keyboard: rows };
}

// قالب‌بندی صفحه بازی با مربع‌های زیباتر
function formatGameBoard(board) {
  return board
    .map((row) => row.map((cell) => (cell.text === 'X' ? '❌' : cell.text === 'O' ? '⭕' : '⬜')).join(' '))
    .join('\n');
}

// بررسی برنده
function checkWinner(board, size, lastMove) {
  if (!lastMove) return null;
  const { row, col } = lastMove;
  const player = board[row][col].text;

  // بررسی ردیف
  let count = 0;
  for (let i = 0; i < size; i++) {
    if (board[row][i].text === player) count++;
    else count = 0;
    if (count === size) return player;
  }

  // بررسی ستون
  count = 0;
  for (let i = 0; i < size; i++) {
    if (board[i][col].text === player) count++;
    else count = 0;
    if (count === size) return player;
  }

  // بررسی قطر اصلی (اگر حرکت روی قطر اصلی باشد)
  if (row === col) {
    count = 0;
    for (let i = 0; i < size; i++) {
      if (board[i][i].text === player) count++;
      else count = 0;
      if (count === size) return player;
    }
  }

  // بررسی قطر فرعی (اگر حرکت روی قطر فرعی باشد)
  if (row + col === size - 1) {
    count = 0;
    for (let i = 0; i < size; i++) {
      if (board[i][size - 1 - i].text === player) count++;
      else count = 0;
      if (count === size) return player;
    }
  }
  return null;
}

// بررسی تساوی
function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell.text !== ' '));
}

// حرکت ربات
function getBotMove(board, size) {
  // بررسی حرکت برنده برای ربات
  for (let i = 0; i < size * size; i++) {
    const row = Math.floor(i / size);
    const col = i % size;
    if (board[row][col].text === ' ') {
      board[row][col].text = 'O';
      if (checkWinner(board, size, { row, col }) === 'O') {
        return { row, col };
      }
      board[row][col].text = ' '; // بازگرداندن حرکت
    }
  }

  // جلوگیری از برد کاربر
  for (let i = 0; i < size * size; i++) {
    const row = Math.floor(i / size);
    const col = i % size;
    if (board[row][col].text === ' ') {
      board[row][col].text = 'X';
      if (checkWinner(board, size, { row, col }) === 'X') {
        board[row][col].text = 'O'; // ربات این خانه را انتخاب می‌کند
        return { row, col };
      }
      board[row][col].text = ' '; // بازگرداندن حرکت
    }
  }

  // حرکت تصادفی
  const emptyCells = [];
  for (let i = 0; i < size * size; i++) {
    const row = Math.floor(i / size);
    const col = i % size;
    if (board[row][col].text === ' ') {
      emptyCells.push({ row, col });
    }
  }
  if (emptyCells.length > 0) {
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
  return null;
}

// لغزش‌زنی (Undo)
async function undoMove(chatId) {
  const user = userData.get(chatId);
  if (!user || user.history.length < 2) {
    console.error('Not enough moves to undo'); // لاگ برای ردیابی
    return;
  }

  // بازگرداندن آخرین دو حرکت (کاربر و ربات)
  const lastMove = user.history.pop(); // حرکت ربات
  const secondLastMove = user.history.pop(); // حرکت کاربر

  // بازگرداندن خانه‌ها به حالت قبلی
  const board = user.board.inline_keyboard;
  board[lastMove.row][lastMove.col].text = ' ';
  board[secondLastMove.row][secondLastMove.col].text = ' ';

  // به‌روزرسانی صفحه بازی
  user.currentPlayer = 'X'; // بازگشت به نوبت کاربر
  user.lastActivity = Date.now();
  await updateGame(chatId, user);
}

// ارسال پیام
async function sendMessage(chatId, text, keyboard) {
  return callTelegramApi('sendMessage', { chat_id: chatId, text, reply_markup: keyboard, parse_mode: 'HTML' });
}

// ویرایش پیام
async function editMessage(chatId, messageId, text, keyboard) {
  return callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

// فراخوانی API تلگرام
async function callTelegramApi(method, data) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.error(`Telegram API Error (${method}):`, await response.text());
    }
    return await response.json();
  } catch (error) {
    console.error('Error calling Telegram API:', error);
    setTimeout(() => callTelegramApi(method, data), 1000); // تلاش مجدد پس از 1 ثانیه
  }
}