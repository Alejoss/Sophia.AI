import React from 'react';
import { Route, Switch } from 'react-router-dom';
import ProfileList from './profiles/ProfileList';
import ContentList from './content/ContentList';
import CourseList from './courses/CourseList';
import App from './App';

const BaseRouter = () => (
    <Switch>
        <Route exact path="/" component={App} />
        <Route path="/profiles" component={ProfileList} />
        <Route path="/content" component={ContentList} />
        <Route path="/courses" component={CourseList} />
        {/* Additional routes here */}
    </Switch>
);

export default BaseRouter;
