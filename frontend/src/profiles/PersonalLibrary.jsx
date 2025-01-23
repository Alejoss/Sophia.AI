
const PersonalLibrary = () => {
  console.log('hola mundo');

  return (
    <div className="col-md-8 col-lg-9 order-md-1">
      <div className="row">
        <div className="media media-avatar-view flex-column flex-sm-row">
          <div className="media-body">
            <span className="text-muted font-size-15 mb-1 d-block">
              Save content to your personal library, send it to the blockchain and interact with it using AI.
            </span>
          </div>
        </div>
        <div className="media media-avatar-view flex-column flex-sm-row">
          <div className="media-body">
            <hr />
            <span className="text-muted font-size-15 mb-1 d-block">
              LIBRARY SETTINGS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalLibrary;

