import React from 'react';
import '../about.css';
const About = () => {
    console.log('estoy en about');

    return (
        <div>
            <h1>Academia Blockchain: Decentralizing Education for the Future</h1>

            <div className="feature-block">
                <h4>Efficient Searching</h4>
                <p>Integrates with Kandra to enable efficient searching through users' libraries.</p>
            </div>

            <div className="feature-block">
                <h4>Cryptocurrency Payments</h4>
                <p>Utilizes Unstoppable Domains to facilitate cryptocurrency payments for teachers.</p>
            </div>

            <div className="feature-block">
                <h4>Blockchain Certificates</h4>
                <p>Archives education certificates on the blockchain for secure and verifiable storage.</p>
            </div>

            <div className="feature-block">
                <h4>Document Hashing</h4>
                <p>Allows users to hash documents and record the hash on the blockchain, ensuring data integrity.</p>
            </div>

            <div className="feature-block">
                <h4>IPFS Document Storage</h4>
                <p>Enables users to upload documents to the InterPlanetary File System (IPFS) and store the corresponding Content Identifier (CID) on the blockchain.</p>
            </div>

            <div className="feature-block">
                <h4>ACBC Tokens</h4>
                <p>Distributes ACBC tokens as rewards to users, incentivizing participation and engagement.</p>
            </div>
        </div>
    );
};

export default About;
