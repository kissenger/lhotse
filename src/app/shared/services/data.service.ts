import { EventEmitter, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class DataService {
    public isBlogDataEmitter = new EventEmitter();
}