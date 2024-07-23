import React, { useState, useEffect } from 'react';
import clienteAxios from '../config/axios';

const Certificates = () => {
  const [certificates, setCertificates] = useState({
    greenDiamonds: 0,
    yellowDiamonds: 0,
    purpleDiamonds: 0,
    blueDiamonds: 0
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        console.log('Fetching profile data');
        const { data } = await clienteAxios.get('/profiles');
        console.log(data[0]);

        setCertificates({
          greenDiamonds: data[0].green_diamonds || 0,
          yellowDiamonds: data[0].yellow_diamonds || 0,
          purpleDiamonds: data[0].purple_diamonds || 0,
          blueDiamonds: data[0].blue_diamonds || 0
        });
      } catch (error) {
        console.error('Error al buscar perfiles:', error);
      }
    };

    fetchProfileData();
  }, []);

  return (
    <div>
      <p>
        Here you can find your certificates. Remember that to receive a certificate, you must request it (you can do this on the event page).
        The creator must accept your request.
      </p>

      <h3>Your Certificates</h3>
      <div className="container">
        <div className="row">
          <div className="col-md">
            <h4>Green Diamonds</h4>
            <p>{certificates.greenDiamonds}</p>
          </div>
          <div className="col-md">
            <h4>Yellow Diamonds</h4>
            <p>{certificates.yellowDiamonds}</p>
          </div>
          <div className="col-md">
            <h4>Purple Diamonds</h4>
            <p>{certificates.purpleDiamonds}</p>
          </div>
          <div className="col-md">
            <h4>Blue Diamonds</h4>
            <p>{certificates.blueDiamonds}</p>
          </div>
        </div>
        <div class="certificate-block">
    <h4>Certificate on Blockchain for Modern Corporations</h4>
    <a href="#">Send to the Blockchain</a>
  </div>
      </div>
    </div>
  );
};

export default Certificates;
