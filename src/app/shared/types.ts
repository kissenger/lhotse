


export class BlogPost {
  _id: string = '';
  slug: string = '';
  title: string = 'New Post';
  subtitle: string = '';
  imgFname: string = '';
  imgAlt: string = '';
  intro: string = '';
  timeStamp: string = '';
  faqs: Array<{question: string, answer: string}> = [{question: '', answer: ''}]
  callToAction: string = '';
}

export type InstaPost = {
  caption: string,
  media_url: string,
  permalink: string,
  media_type: string,
  timestamp: string,
  category: 'Instagram',
  header: ''
}

export type ArticlePreview = {
  caption: string,
  media_url: string,
  permalink: string,
  category: 'Article',
  header: string,
  timestamp: '',
  media_type: '',
}

export type Article = {
  imagePath: string,
  header: string,
  caption: string,
  href: string
}

export type ImageType = 'partner' | 'social' | 'article' | 'slideshow' | 'content' | 'parallax' | 'banner';

export type Image = {
  type: ImageType,
  url: string,
  ext: string,
  alt: string,  
  orientation?: {
    portrait: {height: number, width: number},
    landscape: {height: number, width: number},
  },
  size?: {
    large?: {height: number, width: number},
    small: {height: number, width: number},
    extended?: {height: number, width: number},
  }
}

export type LinkImage = {
  href: string
} & Image

export type ImageCollection = {
  [shortName: string]: Image | LinkImage
}

export type DeviceOrientation = 'landscape' | 'portrait' | undefined;

export type WidthDescriptor = 'large' | 'small' | 'extended' | null;
