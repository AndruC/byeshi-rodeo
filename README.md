# Owlbear Rodeo Clone

![Demo Image](/demo.jpg)

Modified source code for Owlbear Rodeo 1.0 since released for non-profit, non-commercial, private use.

## Install

### Production (or for non-developers)

The easiest way to host Owlbear Rodeo is by using a cloud provider.

To make this even easier we have provided a blueprint that will allow you to host it on [Render](https://render.com/).

Clicking the button bellow will open the Render website where you can create an account and setup a server for free.
Once deployed Render will provide a URL for you to share with your players.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Locally

#### **Docker**

To use the project with docker you can run the following from the root directory of the project:

```
docker-compose up
```

Note: You will need to increase your max memory allowed in Docker to 5GB in order to build Owlbear Rodeo.

#### **Manual**

If you don't want to use Docker you can run both the backend and frontend manually.

Before running the commands you will need both `NodeJS v16` and `Yarn` installed.

To build and run the backend in `/backend` run:

```
yarn build
```

and:

```
yarn start
```

To run the frontend in the root folder run:

```
yarn start
```

## Troubleshooting

**Custom Images Aren't Showing on Other Computers**

Custom images are transferred using WebRTC in order to navigate some networks you must define a STUN/TURN server.

You can read more about this topic here https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols

While there are some freely available STUN servers, most TURN servers charge you for the bandwidth used.

To change the STUN/TURN configuration you can edit the `/backend/ice.json` file.

---

## License

This project is for **personal** use only.

You may not modify, publish, transmit, participate in the transfer or sale of, reproduce, create new works from, display, communicate to the public or in any way exploit, any part of this project in any way for commercial purposes.

## Credits

Original project created by [Nicola](https://github.com/nthouliss) and [Mitch](https://github.com/mitchemmc).
To ensure that the license is adhered to images have been replaced with CC0 images.
Here are a list of the image libraries used to make these new tokens:

- [496 pixel art icons for medieval/fantasy RPG](https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg)
- [CC0 Music Icons](https://opengameart.org/content/cc0-music-icons)
- [Dungeon Crawl 32x32 tiles supplemental](https://opengameart.org/content/dungeon-crawl-32x32-tiles-supplemental)
- [Zombie and Skeleton 32x48](https://opengameart.org/content/zombie-and-skeleton-32x48)
- [RPG portraits](https://opengameart.org/content/rpg-portraits)
