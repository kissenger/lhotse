
export class BlogPost {
  _id: string = '';
  slug: string = '';
  title: string = 'New Post';
  type: 'faq' | 'article' = 'faq';
  isPublished: boolean = false;
  keywords: Array<string> = [''];
  subtitle: string = '';
  imgFname: string = '';
  imgAlt: string = '';
  intro: string = '';
  timeStamp: string = '';
  sections: Array<{title: string, content: string, imgFname: string, imgAlt: string}> = [{title: '', content: '', imgFname: '', imgAlt: ''}]
  conclusion: string = '';
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
