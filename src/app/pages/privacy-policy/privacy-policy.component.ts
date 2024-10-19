import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-privacy-policy',
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.css']
})

export class PrivacyComponent implements OnInit {

  constructor(
    public location: Location
  ) { }

  ngOnInit(): void {

  }

}
