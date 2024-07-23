import React, { useState, useEffect } from 'react';
import clienteAxios from '../config/axios';
import { useNavigate } from 'react-router-dom'; // Importa useNavigate
import VerticalMenu from '../components/VerticalNavProfile';
import { Outlet } from 'react-router-dom';

import HeaderComp from '../components/headerComp';



const ProfileLayout = () => {
    console.log('hola mundo')

    return (

        <div>


        <HeaderComp/>
            <VerticalMenu/>
            <Outlet/>

        </div>


        );
    }

export default ProfileLayout;