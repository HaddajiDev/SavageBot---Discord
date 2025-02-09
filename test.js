const axios = require('axios');

async function testInteraction() {
  const payload = {
    type: 2
  };

  try {
    const response = await axios.post('http://localhost:3000/api/interactions', payload, {
      headers: {
        "Content-Type": "application/json",        
        "x-signature-ed25519": "test-signature",
        "x-signature-timestamp": Date.now().toString()
      }
    });
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

testInteraction();
