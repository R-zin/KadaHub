const authDomain = require('../services/authDomain');

const register = async (req, res, next) => {
  try {
    const { name, email, password, role, storeName, phone } = req.body;
    const result = await authDomain.register({ name, email, password, role, storeName, phone });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await authDomain.login(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    res.json({ user: await authDomain.me(req.user.id) });
  } catch (err) { next(err); }
};

module.exports = { register, login, me };
