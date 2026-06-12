import axios from 'axios';

async function run() {
  try {
    const res = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'eyder@norder.com',
      password: 'password123'
    });
    console.log(res.data.token);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
run();
