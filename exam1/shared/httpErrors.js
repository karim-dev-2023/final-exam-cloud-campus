function httpErrors(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413
    : error.type === 'entity.parse.failed' || error.name === 'CastError' || error.name === 'ValidationError' ? 400
      : error.code === 11000 ? 409 : 500;
  return res.status(status).json({ message: status === 500 ? 'Erreur serveur.' : 'Requête invalide.' });
}
module.exports = { httpErrors };
