const User = require('../models/User');
var faker = require('faker');
var bcrypt = require('bcryptjs');

async function clearUsers() {
  //there is not req argument
  console.log('Refreshing Users');
  let users = [];
  const salt = await bcrypt.genSalt(10);
  // const password = await bcrypt.hash(req.body.password, salt);
  //since there is no req argument in functin, it is using undefine password
  //if u turn corn on, it will give errors

  //fix below
  const password = await bcrypt.hash('admin', salt);
  users.push({
    name: 'Usman Akram',
    email: 'admin@admin.com',
    password,
    roles: ['customer', 'admin'],
  });

  await User.deleteMany({});
  User.collection.insertMany(users, (err, docs) => {
    if (err) {
      console.error('Error Occured: ' + err);
    } else {
      console.info('bulk inserted');
    }
  });
}

module.exports = clearUsers;
