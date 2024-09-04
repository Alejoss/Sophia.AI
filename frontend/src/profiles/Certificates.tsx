import { useState, useEffect } from 'react';
import { getUserProfile } from "../api/profilesApi.ts"; // Importa la función desde el archivo

const Certificates = () => {
  const [certificates, setCertificates] = useState({
    greenDiamonds: 0,
    yellowDiamonds: 0,
    purpleDiamonds: 0,
    blueDiamonds: 0
  });

  // Recupera el nombre de usuario almacenado (asumiendo que se almacena en localStorage)
  // TODO esto debe ir en un slice de redux
  const storedUsername = localStorage.getItem('userName');

  useEffect(() => {
    const SetProfileData = async () => {
      try {
        console.log('Fetching profile data');
        const { user } = await getUserProfile(storedUsername);

        if (user) {
          setCertificates({
            greenDiamonds: user.green_diamonds || 0,
            yellowDiamonds: user.yellow_diamonds || 0,
            purpleDiamonds: user.purple_diamonds || 0,
            blueDiamonds: user.blue_diamonds || 0
          });
        }
      } catch (error) {
        console.error('Error al buscar perfiles:', error);
      }
    };

    SetProfileData();
  }, [storedUsername]);

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
        <div className="certificate-block">
          <h4>Certificate on Blockchain for Modern Corporations</h4>
          <a href="#">Send to the Blockchain</a>
        </div>
      </div>
    </div>
  );
};

export default Certificates;

