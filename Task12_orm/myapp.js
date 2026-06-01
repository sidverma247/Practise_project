const { model } = require('./orm');

const User = model('User', {
  id:    { type: 'number', primary: true },
  name:  { type: 'string', required: true },
  email: { type: 'string', unique: true },
});

async function main() {
  const user = await User.create({ name: 'John', email: 'john@example.com' });
  console.log('Created user:', user);

  const found = await User.findById(user.id);
  console.log('Found:', found.name);
}

main();