import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../api/axiosConfig.js';

const ProfileDetail = () => {
    const { profileId } = useParams();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                const response = await axiosInstance.get(`/profiles/${profileId}`);  // Use Axios instance
                setProfile(response.data);
                setError(null); // Clear any previous errors
            } catch (err) {
                setError(err.message);
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [profileId]); // Depend on profileId to refetch if it changes

    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error: {error}</p>;
    if (!profile) return <p>No profile found</p>;

    return (
        <div>
            <h1>Profile: {profile.user.username}</h1>
            <img src={profile.profile_picture || 'default_profile_pic.jpg'} alt="Profile" />
            <p>Description: {profile.profile_description}</p>
            <p>Timezone: {profile.timezone}</p>
            <p>Interests: {profile.interests}</p>
            <p>Teaching Status: {profile.is_teacher ? 'Teacher' : 'Student'}</p>
            <p>Email Confirmed: {profile.email_confirmed ? 'Yes' : 'No'}</p>
            <p>Green Diamonds: {profile.green_diamonds}</p>
            <p>Yellow Diamonds: {profile.yellow_diamonds}</p>
            <p>Purple Diamonds: {profile.purple_diamonds}</p>
            <p>Blue Diamonds: {profile.blue_diamonds}</p>
            <div>
                <h3>Cryptocurrencies:</h3>
                {profile.cryptos_list.length > 0 ? (
                    <ul>
                        {profile.cryptos_list.map(crypto => (
                            <li key={crypto.id}>{crypto.name} - Address: {crypto.address}</li>
                        ))}
                    </ul>
                ) : (
                    <p>No cryptocurrencies listed.</p>
                )}
            </div>
        </div>
    );
};

export default ProfileDetail;
