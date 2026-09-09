const authDomain = require('../services/authDomain');
const asyncH = require('../utils/asyncHandler');

const register = asyncH(async (req, res) => {
  const { name, email, password, role, storeName, phone } = req.body;
  const result = await authDomain.register({ name, email, password, role, storeName, phone });
  res.status(201).json(result);
});

const login = asyncH(async (req, res) => {
  const result = await authDomain.login(req.body);
  res.json(result);
});

const me = asyncH(async (req, res) => {
  res.json({ user: await authDomain.me(req.user.id) });
});

module.exports = { register, login, me };
