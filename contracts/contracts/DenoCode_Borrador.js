// Import necessary libraries
import { create } from 'https://deno.land/x/ipfs_http_client/mod.ts';
import { sha256 } from 'https://deno.land/std/hash/mod.ts';

// Function to scrape the website
async function scrapeWebsite(url: string): Promise<string> {
  const response = await fetch(url);
  const html = await response.text();

  // Basic HTML parsing to extract text (customize as needed)
  const text = html.replace(/<[^>]*>/g, ''); // Remove HTML tags
  return text;
}

// Function to check if text is AI-generated using GPTZero API
async function checkWithGPTZero(text: string): Promise<boolean> {
  const response = await fetch('https://api.gptzero.me/v1/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();
  return data.isAI; // Assuming the API returns a boolean field 'isAI'
}

// Function to save text to IPFS and get the CID
async function saveToIPFS(text: string): Promise<string> {
  const ipfs = create('https://ipfs.infura.io:5001');
  const { cid } = await ipfs.add(text);
  return cid.toString();
}

// Main function to process the URL and return the hash and IPFS CID
async function processURL(url: string) {
  // Scrape the website
  const text = await scrapeWebsite(url);

  // Check if the text is AI-generated
  const isAI = await checkWithGPTZero(text);
  if (isAI) {
    throw new Error('The text is AI-generated');
  }

  // Save the text to IPFS
  const ipfsCid = await saveToIPFS(text);

  // Compute the SHA-256 hash of the text
  const hashBuffer = new TextEncoder().encode(text);
  const hashArray = new Uint8Array(await crypto.subtle.digest('SHA-256', hashBuffer));
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

  // Return the hash and IPFS CID
  return { hash: hashHex, ipfsCid };
}

// Example usage
const url = 'https://example.com'; // Replace with the actual URL
processURL(url)
  .then(result => {
    console.log('Hash:', result.hash);
    console.log('IPFS CID:', result.ipfsCid);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
