
export class BlogPost {
  _id: string = '';
  slug: string = '';
  title: string = 'New Post';
  type: 'faq' | 'article' = 'faq';
  isPublished: boolean = false;
  keywords: Array<string> = [];
  subtitle: string = '';
  imgFname: string = '';
  imgAlt: string = '';
  intro: string = '';
  sections: Array<{title: string, content: string, imgFname: string, imgAlt: string}> = [{title: '', content: '', imgFname: '', imgAlt: ''}]
  conclusion: string = '';
  createdAt: string = '';
  updatedAt: string = '';
}

export type DeviceOrientation = 'landscape' | 'portrait' | undefined;

export type WidthDescriptor = 'large' | 'small' | undefined;
