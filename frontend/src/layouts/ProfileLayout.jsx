import VerticalMenu from '../components/VerticalNavProfile.jsx';
import { Outlet } from 'react-router-dom';

import HeaderComp from '../components/HeaderComp.jsx';



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
