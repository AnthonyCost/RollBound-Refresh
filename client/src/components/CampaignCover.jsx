/** A campaign's cover art with its title over it, or an ornamental banner when there's no image. */
export default function CampaignCover({ name, coverUrl, subtitle }) {
  return (
    <div className={`cover ${coverUrl ? '' : 'cover--plain'}`}>
      {coverUrl && <img className="cover__img" src={coverUrl} alt="" />}
      <div className="cover__text">
        <h2 className="cover__title">{name}</h2>
        {subtitle && <p className="cover__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
