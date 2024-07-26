import VerticalMenu from '../components/VerticalNavProfile';
import { Outlet } from 'react-router-dom';

import HeaderComp from '../components/HeaderComp.tsx';



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