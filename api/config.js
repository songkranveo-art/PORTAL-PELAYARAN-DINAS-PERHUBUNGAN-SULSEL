module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
};
