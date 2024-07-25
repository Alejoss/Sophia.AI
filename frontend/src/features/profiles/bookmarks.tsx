import React, { useState, useEffect } from 'react';
import clienteAxios from '/src/api/axios.ts';
import { useNavigate } from 'react-router-dom';



const Bookmarks: React.FC = () => {
  console.log('hola mundo');

  return (
    <div className="col-md-8 col-lg-9 order-md-1">
      <div className="row">
        <div className="media media-avator-view flex-column flex-sm-row">
          <div className="media-body">
            <span className="text-muted font-size-15 mb-3 d-block">
              You can save the courses and events that interest you by clicking on "I'm Interested" on the event page.
              On this page, you can request a certificate from the organizer.
            </span>
            <div className="text-white rounded bg-warning text-uppercase font-weight-medium px-6 py-3 mb-3">
              &nbsp; Your Saved Courses and Events
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookmarks;
