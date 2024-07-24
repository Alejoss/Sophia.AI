import React from 'react'
import HeaderComp from '../components/headerComp';

import { Outlet } from 'react-router-dom';
const HomeLayout = () => {
  return (
    <>
    <div>
        <HeaderComp/>
            <Outlet/>


        </div>

    </>
      )
}

export default HomeLayout